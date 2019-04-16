drop schema if exists graphql, graphql_private cascade;
create schema graphql;
create schema graphql_private;

create table graphql.dependency (
  id serial primary key,
  tree_hash text,
  name text,
  version text,
  paths text
);

insert into graphql.dependency (tree_hash, name, version, paths) values ('key', 'Hello', 'World', '!');

create type graphql_private.dependencies_return_type as (
  name text,
  version text,
  paths text
);

CREATE OR REPLACE FUNCTION graphql.packagedependency(tree_hash text, name text, version text)
  RETURNS graphql_private.dependencies_return_type
  AS $$
    SELECT d.name, d.version, d.paths
      FROM graphql.dependency d
      WHERE d.tree_hash = $1 AND d.name = $2 AND d.version = $3
  $$ LANGUAGE sql STABLE;

