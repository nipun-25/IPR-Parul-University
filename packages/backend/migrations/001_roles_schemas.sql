-- ==============================================================================
-- Migration: 001_roles_schemas.sql
-- Description: Core roles, schemas, extensions, and baseline privilege lockdown
-- Database: PostgreSQL 14+
-- Gate: B1 SQL Migration Authoring (Security & Integrity Corrections)
-- ==============================================================================

-- 1. Create Non-Login Architectural Roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ipr_admin') THEN
        CREATE ROLE ipr_admin WITH NOLOGIN NOSUPERUSER INHERIT NOCREATEDB NOCREATEROLE;
        COMMENT ON ROLE ipr_admin IS 'Administrative owner of database tables, sequences, and structural schema objects';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ipr_definer') THEN
        CREATE ROLE ipr_definer WITH NOLOGIN NOSUPERUSER INHERIT NOCREATEDB NOCREATEROLE;
        COMMENT ON ROLE ipr_definer IS 'Definer owner for security definer institutional mutation gateways';
    END IF;

    -- Ensure current executing role is granted membership in ipr_admin and ipr_definer
    -- so that subsequent ALTER TABLE ... OWNER TO ipr_admin and ALTER DEFAULT PRIVILEGES succeed.
    -- Fails visibly if current_user lacks administrative permission.
    EXECUTE format('GRANT ipr_admin, ipr_definer TO %I', current_user);
END $$;

-- 2. Create Runtime Login Roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ipr_app') THEN
        CREATE ROLE ipr_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
        COMMENT ON ROLE ipr_app IS 'Express backend application runtime login role';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ipr_scanner') THEN
        CREATE ROLE ipr_scanner WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
        COMMENT ON ROLE ipr_scanner IS 'Antivirus background scanner worker runtime login role';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ipr_worker') THEN
        CREATE ROLE ipr_worker WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
        COMMENT ON ROLE ipr_worker IS 'Transactional outbox background worker runtime login role';
    END IF;
END $$;

-- 3. Dynamic Database Privilege Lockdown
-- Fix: PostgreSQL syntax requires dynamic execution for database identifiers
DO $$
DECLARE
    v_db_name TEXT := current_database();
BEGIN
    EXECUTE format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM ipr_app, ipr_scanner, ipr_worker', v_db_name);
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO ipr_app, ipr_scanner, ipr_worker', v_db_name);
END $$;

-- 4. Cryptographic Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- 5. Schemas and Baseline Ownership
CREATE SCHEMA IF NOT EXISTS auth_internal;
ALTER SCHEMA auth_internal OWNER TO ipr_admin;

-- Schema public ownership assignment fails visibly if executing role is not authorized
ALTER SCHEMA public OWNER TO ipr_admin;

-- 6. Default Lockdown on Schemas
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA auth_internal FROM PUBLIC;

-- Revoke CREATE on public to prevent temporary or rogue object injection
REVOKE CREATE ON SCHEMA public FROM PUBLIC, ipr_app, ipr_scanner, ipr_worker;

-- Grant controlled USAGE on schemas
GRANT USAGE ON SCHEMA public TO ipr_app, ipr_scanner, ipr_worker, ipr_definer;
GRANT USAGE ON SCHEMA auth_internal TO ipr_definer;
