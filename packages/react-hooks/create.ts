// /*

// Generic mutation wrapper to insert a new document in a collection and update
// a related query on the client with the new item and a new total item count.

// Sample mutation:

//   mutation createMovie($data: CreateMovieData) {
//     createMovie(data: $data) {
//       data {
//         _id
//         name
//         __typename
//       }
//       __typename
//     }
//   }

// Arguments:

//   - data: the document to insert

// Child Props:

//   - createMovie({ data })

// */

import { useMutation, MutationResult, gql, FetchResult } from "@apollo/client";

import { filterFunction } from "@vulcanjs/mongo";
import { createClientTemplate } from "@vulcanjs/graphql";

import { multiQueryUpdater, ComputeNewDataFunc } from "./multiQueryUpdater";
import { VulcanMutationHookOptions } from "./typings";

import { addToData, matchSelector } from "./cacheUpdate";
import { CreateVariables } from "@vulcanjs/graphql"; // TODO: we should depend only on client code

import debug from "debug";
const debugApollo = debug("vn:apollo");
/**
 * Compute the new list after a create mutation
 * @param param0
 */
export const computeNewDataAfterCreate: ComputeNewDataFunc = async ({
  model,
  variables,
  queryResult,
  mutatedDocument,
  multiResolverName,
}) => {
  const newDoc = mutatedDocument;
  // get mongo selector and options objects based on current terms
  const multiInput = variables.input;
  // TODO: the 3rd argument is the context, not available here
  // Maybe we could pass the currentUser? The context is passed to custom filters function
  const filter = await filterFunction(model, multiInput, {});
  const { selector, options: paramOptions } = filter;
  const { sort } = paramOptions;
  debugApollo("Got query", queryResult, ", and filter", filter);
  // check if the document should be included in this query, given the query filters
  if (matchSelector(newDoc, selector)) {
    debugApollo("Document matched, updating the data");
    // TODO: handle order using the selector
    const newData = addToData({
      queryResult,
      multiResolverName,
      document: newDoc,
      sort,
      selector,
    });
    return newData;
  }
  return null;
};
const multiQueryUpdaterAfterCreate = multiQueryUpdater(
  computeNewDataAfterCreate
);

export const buildCreateQuery = ({ typeName, fragmentName, fragment }) => {
  const query = gql`
    ${createClientTemplate({ typeName, fragmentName })}
    ${fragment}
  `;
  return query;
};

// Add data into the resolverName
const buildResult = <TModel = any>(
  options,
  resolverName,
  executionResult
): CreateResult<TModel> => {
  const { data } = executionResult;
  const props = {
    ...executionResult,
    document: data && data[resolverName] && data[resolverName].data,
  };
  return props;
};

interface UseCreateOptions<TData, TVariables>
  extends VulcanMutationHookOptions<TData, TVariables> {}
/**
 * Result of the actual create function
 */
interface CreateResult<TModel = any, TData = any> extends FetchResult<TData> {
  data: TData;
  document: TModel;
}
type CreateFunc<TModel = any, TData = any> = (
  args: CreateVariables<TData>
) => Promise<CreateResult<TModel, TData>>;

type UseCreateResult<TModel = any, TData = any> = [
  CreateFunc<TModel>,
  MutationResult<TData>
]; // return the usual useMutation result, but with an abstracted creation function
export const useCreate = <TModel = any>(
  options: UseCreateOptions<any, CreateVariables>
): UseCreateResult<TModel> => {
  const {
    model,
    fragment = model.graphql.defaultFragment,
    fragmentName = model.graphql.defaultFragmentName,
    mutationOptions = {},
  } = options;

  const { typeName } = model.graphql;

  const query = buildCreateQuery({ typeName, fragmentName, fragment });

  const resolverName = `create${typeName}`;

  const [createFunc, ...rest] = useMutation<any, CreateVariables<TModel>>(
    query,
    {
      update: multiQueryUpdaterAfterCreate({
        model,
        fragment,
        fragmentName,
        resolverName,
      }),
      ...mutationOptions,
    }
  );

  const extendedCreateFunc = async (variables: CreateVariables<TModel>) => {
    const executionResult = await createFunc({
      variables: { input: variables.input },
    });
    return buildResult<TModel>(options, resolverName, executionResult);
  };
  return [extendedCreateFunc, ...rest];
};
