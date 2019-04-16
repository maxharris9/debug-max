const { gql, makeExtendSchemaPlugin } = require('graphile-utils');

async function fetchPackage() {}

module.exports = makeExtendSchemaPlugin(({pgSql: sql}) => ({
  typeDefs: gql`
    extend type Query {
      packageDetails(treeHash: String, name: String, version: String): DependenciesReturnType
    }
  `,
  resolvers: {
    Query: {
      packageDetails: async (root, args, context, info) => {
        const pkg = await fetchPackage(args.name, args.version)
        // I've verified that pkg, args, etc. all have the desired args
        const dependencies = await info.graphile.selectGraphQLResultFromTable(
          sql.query`graphql.packagedependency(${sql.value(args.treeHash)}, ${sql.value(args.name)}, ${sql.value(args.version)})`,
          () => {
          }
        )
        console.log('dependencies:', dependencies)
        return dependencies[0];

      }
    }
  }
}));
