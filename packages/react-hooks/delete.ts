/*

 Generic mutation wrapper to remove a document from a collection.

 Sample mutation:

   mutation deleteMovie($input: DeleteMovieInput) {
    deleteMovie(input: $input) {
      data {
        _id
        name
        __typename
      }
      __typename
    }
  }

 Arguments:

   - input
     - input.selector: the id of the document to remove

 Child Props:

   - deleteMovie({ selector })

 */

import { useMutation, MutationResult, gql } from "@apollo/client";
import { deleteClientTemplate } from "@vulcanjs/graphql";
import { removeFromData } from "./cacheUpdate";
import { computeQueryVariables } from "./variables";
import { VulcanMutationHookOptions } from "./typings";

export const buildDeleteQuery = ({ typeName, fragmentName, fragment }) =>
  gql`
    ${deleteClientTemplate({ typeName, fragmentName })}
    ${fragment}
  `;

import { multiQueryUpdater, ComputeNewDataFunc } from "./multiQueryUpdater";

/**
 * Compute new list for removed elements
 * @param param0
 */
const computeNewDataAfterDelete: ComputeNewDataFunc = ({
  queryResult,
  multiResolverName,
  mutatedDocument,
}) => {
  const removedDoc = mutatedDocument;
  const newData = removeFromData({
    queryResult,
    multiResolverName,
    document: removedDoc,
  });
  return newData;
};
// remove value from the cached lists
// TODO: factorize with create.ts
const multiQueryUpdaterAfterDelete = multiQueryUpdater(
  computeNewDataAfterDelete
);

interface DeleteInput {
  id: string;
}
interface DeleteVariables {
  input: DeleteInput;
}
interface UseDeleteOptions
  extends VulcanMutationHookOptions,
    Partial<DeleteVariables> {}

interface DeleteFuncResult<TModel> {
  document: TModel;
}
type DeleteFunc<TModel> = (
  args: DeleteVariables
) => Promise<DeleteFuncResult<TModel>>;
type UseDeleteResult<TModel, TData = any> = [
  DeleteFunc<TModel>,
  MutationResult<TData>
];
export const useDelete = <TModel>(
  options: UseDeleteOptions
): UseDeleteResult<TModel> => {
  const {
    model,
    fragment = model.graphql.defaultFragment,
    fragmentName = model.graphql.defaultFragmentName,
    mutationOptions = {},
  } = options;

  const { typeName } = model.graphql;

  const query = buildDeleteQuery({
    fragment,
    fragmentName,
    typeName,
  });

  const resolverName = `delete${typeName}`;

  const [deleteFunc, ...rest] = useMutation(query, {
    // optimistic update
    update: multiQueryUpdaterAfterDelete({
      model,
      fragment,
      fragmentName,
      resolverName,
    }),
    ...mutationOptions,
  });
  const extendedDeleteFunc = async (
    args: DeleteVariables /*{ input: argsInput, _id: argsId }*/
  ) => {
    const executionResult = await deleteFunc({
      variables: {
        ...computeQueryVariables(options, args),
      },
    });
    const { data } = executionResult;
    return { ...executionResult, document: data?.[resolverName]?.data };
  };
  return [extendedDeleteFunc, ...rest];
};
