/**
 * Differences with Vulcan Meteor:
 * - No more "propertyName" option, data are returned in the "document" shortcut
 */
import _merge from "lodash/merge";

import {
  singleClientTemplate,
  VulcanGraphqlModel,
  SingleInput,
} from "@vulcanjs/graphql";

import { computeQueryVariables } from "./variables";
import {
  OperationVariables,
  useQuery,
  QueryOptions,
  gql,
  QueryResult,
} from "@apollo/client";
import { Fragment } from "./typings";

const defaultInput = {
  enableCache: false,
  allowNull: false,
};

export const buildSingleQuery = ({
  typeName,
  fragmentName,
  fragment,
  extraQueries,
}: {
  typeName: string;
  fragmentName?: string;
  fragment?: Fragment;
  extraQueries?: string;
}) => {
  const query = gql`
    ${singleClientTemplate({ typeName, fragmentName, extraQueries })}
    ${fragment}
  `;
  return query;
};

/**
 * Create GraphQL useQuery options and variables based on props and provided options
 * @param {*} options
 * @param {*} props
 */
const buildQueryOptions = <TData = any, TVariables = OperationVariables>(
  options,
  props
): Partial<QueryOptions<TData, TVariables>> => {
  let {
    pollInterval = 20000,
    // generic apollo graphQL options
    queryOptions = {},
  } = options;

  // if this is the SSR process, set pollInterval to null
  // see https://github.com/apollographql/apollo-client/issues/1704#issuecomment-322995855
  pollInterval = typeof window === "undefined" ? null : pollInterval;

  // OpenCrud backwards compatibility
  const graphQLOptions: Partial<
    QueryOptions</*TVariables*/ any, TData> & { pollInterval?: number }
  > = {
    variables: {
      ...computeQueryVariables(
        { ...options, input: _merge({}, defaultInput, options.input || {}) }, // needed to merge in defaultInput, could be improved
        props
      ),
    },
    pollInterval, // note: pollInterval can be set to 0 to disable polling (20s by default)
  };

  // see https://www.apollographql.com/docs/react/features/error-handling/#error-policies
  graphQLOptions.errorPolicy = "all";

  return {
    ...graphQLOptions,
    ...queryOptions,
  };
};

const buildSingleResult = <TModel = any, TData = any>(
  options: UseSingleOptions<TModel>,
  { fragmentName, fragment, resolverName },
  queryResult: QueryResult<TData>
): SingleResult<TData> => {
  const { /* ownProps, */ data, error } = queryResult;
  const result = {
    ...queryResult,
    // Note: Scalar types like Dates are NOT converted. It should be done at the UI level.
    document: data && data[resolverName] && data[resolverName].result,
    fragmentName,
    fragment,
  };
  if (error) {
    // eslint-disable-next-line no-console
    console.log(error);
  }
  return result;
};

interface SingleResult<TModel = any, TData = any> extends QueryResult<TData> {
  fragmentName: string;
  fragment: string;
  document: TModel; // shortcut to get the document
}
interface UseSingleOptions<TModel> {
  model: VulcanGraphqlModel;
  input?: SingleInput<TModel>;
  fragment?: Fragment;
  fragmentName?: string;
  extraQueries?: string;
}

/**
 * Fetch a single, known document
 * @param options
 * @param props
 */
export const useSingle = <TModel = any>(
  options: UseSingleOptions<TModel>,
  props = {}
): SingleResult<TModel> => {
  let {
    model,
    fragment = model.graphql.defaultFragment,
    fragmentName = model.graphql.defaultFragmentName,
    extraQueries,
  } = options;

  const { typeName, singleResolverName: resolverName } = model.graphql;

  const query = buildSingleQuery({
    typeName,
    fragmentName,
    fragment,
    extraQueries,
  });

  const queryResult = useQuery(query, buildQueryOptions(options, props));
  const result = buildSingleResult<TModel>(
    options,
    { fragment, fragmentName, resolverName },
    queryResult
  );
  return result;
};
