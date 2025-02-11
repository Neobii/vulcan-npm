## Lerna

### Install

```sh
# Will install all NPM packages
# It uses yarn workspaces to avoid redundancy
lerna bootstrap
```

#### Use in another local package

In `vulcan-npm`, link all your packages:

```sh
# This is automatically done after an install
yarn link
```

In your app, link packages:

```sh
# USE YARN, it won't work with npm
yarn link @vulcanjs/model
yarn link @vulcanjs/schema
...
# NOTE: we don't yet have a way to link everything
```

### Yarn workspaces

Yarn workspaces allow to share dependencies between packages. This is especially useful for dev dependencies such as Jest.

They are equivalent to using NPM + Lerne "Hoist" feature.

https://classic.yarnpkg.com/blog/2017/08/02/introducing-workspaces/

### Common issues

#### TypeScript syntax not recknognized in end-application

You are importing non built code directly. Example:

```sh
error - /code/vulcan-npm/packages/next-material-ui/components/Link.tsx 10:5
Module parse failed: Unexpected token (10:5)
You may need an appropriate loader to handle this file type, currently no loaders are configured to process this file. See https://webpack.js.org/concepts#loaders
| import MuiLink, { LinkProps as MuiLinkProps } from "@material-ui/core/Link";
|
> type LinkProps = NextLinkProps &
|   MuiLinkProps & {
|     activeClassName?: string;

```

You either forgot to call `yarn build` or did a direct import (`import foobar from "@vulcanjs/reac-hooks/some-not-built-file")`.

#### Code not updating during test

Don't forget to build the code.
If you write a test for package "React Hooks", and discover and fix a bug in package "GraphQL", you'll need to rebuild the "GraphQL" package to get the freshest version.

#### Weird behaviour when linking with React, Apollo, Mongoose.

Define Peer Dependencies correctly. Many packages have side effects that are problematic if you duplicate them. Those packages should be
peer-dependencies in the relevant `package.json`. You may add them at the root of the project too in development.

##### Example with Mongoose

###### Make it a peer dependency

In `packages/mongo/package.json`:

```
peerDependencies: {
    mongoose: "> 5"
}
```

The end application will have only 1 version of Mongoose thanks to this.
In `./package.json`:

```
devDependencies: {
    "mongoose": "^5.10.16"
}
```

###### Setup for local install

This install `mongoose` as a global dev dependency so we can write unit tests for instance.

And now enable local development:
In `scripts/link-duplicates`:

```
cd ./node_modules/@apollo/client && yarn link && cd ../..
```

When you link the packages for local development, the `mongoose` from `vulcan-npm` will be used. This prevents potential conflicts.

In your app:

```
yarn link mongoose
```

It forces your app to use the `mongoose` install from `vulcan-npm`.

This guarantees that you use one and only one version of Mongoose.

Note: we'd like to simplify this process in the future, maybe by detecting peer dependencies automatically.
