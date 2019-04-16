const { gql, makeExtendSchemaPlugin } = require('graphile-utils');

async function fetchPackage() {}

module.exports = makeExtendSchemaPlugin(({pgSql: sql}) => ({
  typeDefs: gql`
    type PackageNameVersion {
      name: String!
      version: String!
    }

    type DependencyPath {
      segments: [PackageNameVersion]
    }

    type PackageDetails {
      name: String!
      version: String!
      published: Boolean!
      publishedAt: String!
      paths: [DependencyPath]
    }

    extend type Query {
      packageDetails(treeHash: String, name: String, version: String): PackageDetails
    }
  `,
  resolvers: {
    Query: {
      packageDetails: async (root, args, context, info) => {
        const pkg = await fetchPackage(args.name, args.version)
        // I've verified that pkg, args, etc. all have the desired args
        const dependencies = await info.graphile.selectGraphQLResultFromTable(
          sql.query`graphql.packagedependency(${sql.value(args.treeHash)}, ${sql.value(args.name)}, ${sql.value(args.version)})`,
          () => {}
        )

        console.log('dependencies:', dependencies) // ParsePath (below) reshapes this. but even when I have it turned off, I get only get `[{}]` in `dependencies`
        
        return {
          name: pkg.name,
          version: pkg.version,
          published: pkg.published,
          publishedAt: pkg.publishedAt,
          paths: [] // just leave this empty right now - `dependencies` contains no data
        }
      }
    }
  }
}));

const ParsePath = builder => {
  builder.hook('GraphQLObjectType:fields:field', (field, build, context) => {
    const { getTypeByName, graphql: { GraphQLList } } = build
    const {
      scope: { pgFieldIntrospection: attr }
    } = context
    if (!attr ||
      attr.kind !== 'attribute' ||
      attr.name !== 'paths' ||
      attr.class.name !== 'dependencies_return_type'
    ) {
      return field
    }

    console.log('YAY RESHAPING')

    return {
      ...field,
      type: GraphQLList(getTypeByName('DependencyPath')),
      resolve: async dependency => {
        /**
         * `dependency.paths` describes how a module in the dependency tree
         *  can be reached. It originally is JSON of this shape:
         *
         *   [[[name, version], ...], ...]
         *
         * Example for `connect`:
         *
         *   [
         *     [['express', '1.0.0']],
         *     []
         *   ]
         *
         * In this example `connect` is both a dependency of `express@1.0.0`
         * and a top level dependency.
         *
         * Here we convert it to an object, so it's easier to consume:
         *
         *    [{ segments: [{ name, version }, ...] }, ...]
         *
         * The same example for `connect`:
         *
         *    [
         *      { segments: [{ name: 'express', version: '1.0.0' }] },
         *      { segments: [] }
         *    ]
         */

        if (!dependency.paths) return []
        const paths = []
        const pathsOld = JSON.parse(dependency.paths)
        for (const pathOld of pathsOld) {
          const path = { segments: [] }
          paths.push(path)
          for (let packageVersion of pathOld) {
            if (typeof packageVersion === 'string') {
              // In the old schema a path segment wasn't [name, version] but
              // `${name}@${version}`
              packageVersion = /^(@?[^@]+)@(.+)$/.exec(packageVersion).slice(1)
            }
            if (!Array.isArray(packageVersion)) {
              log.error('Invalid packageVersion', packageVersion)
              continue
            }
            path.segments.push({
              name: packageVersion[0],
              version: packageVersion[1]
            })
          }
        }
        return paths
      }
    }
  })
}
