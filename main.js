const prompts = require('prompts')

const path = require('path')

// used in quick workaround for
// https://github.com/terkelg/prompts/issues/252
const ansiEscapes = require('ansi-escapes')

const { log } = require('console')

const bulb = require('emoji-bulb')

const createReactNativeLibraryModule = require('create-react-native-module')
const exampleTemplates = require('create-react-native-module/templates/example')

const execa = require('execa')

const fs = require('fs-extra')

const logSymbols = require('log-symbols')

const { paramCase } = require('param-case')
const { pascalCase } = require('pascal-case')

const init = require('@react-native-community/cli/build/commands/init/init')
  .default

const updateNotifier = require('update-notifier')

const pkg = require('./package.json')

const BULB = bulb
const INFO = logSymbols.info
const OK = logSymbols.success
const WARN = logSymbols.warning
const ERROR = logSymbols.error

// used in quick workaround for
// https://github.com/terkelg/prompts/issues/252
const SHOW_CURSOR = ansiEscapes.cursorShow
const NEWLINE = '\n'

const REACT_NATIVE_PREFIX = 'react-native-'

const EXAMPLE_APP_JS_FILENAME = 'App.js'

// rewrite metro.config.js with workaround solutions
const EXAMPLE_METRO_CONFIG_FILENAME = 'metro.config.js'
const EXAMPLE_METRO_CONFIG_WORKAROUND = `// metro.config.js
// with workaround solutions

const path = require('path')

module.exports = {
  // workaround for issue with symlinks encountered starting with
  // metro@0.55 / React Native 0.61
  // (not needed with React Native 0.60 / metro@0.54)
  resolver: {
    extraNodeModules: new Proxy(
      {},
      { get: (_, name) => path.resolve('.', 'node_modules', name) }
    )
  },

  // quick workaround solution for issue with symlinked modules ref:
  // https://github.com/brodybits/create-react-native-module/issues/232
  watchFolders: ['.', '..']
}
`

// path helpers:
const resolveSubpath = (...paths) => path.resolve('.', ...paths)
const joinPath = path.join

// quick workaround ref:
// https://github.com/terkelg/prompts/issues/252
const onState = ({ aborted }) => {
  if (aborted) {
    process.stdout.write(ansiEscapes.cursorShow)
    process.stdout.write(NEWLINE)
    process.exit(1)
  }
}

// with quick workaround for
// https://github.com/terkelg/prompts/issues/252
const prompt = props => prompts([{ onState, ...props }])

const promptForConfirmation = async message => {
  const { confirmation } = await prompt({
    type: 'confirm',
    name: 'confirmation',
    message,
    initial: true
  })

  if (!confirmation) process.exit(1)
}

// notify the user (...)
const notifier = updateNotifier({ pkg })
notifier.notify()

// using Promise.resolve().then(...) to avoid possible issue with
// IIFE directly after expression with no semicolon
Promise.resolve().then(async () => {
  // Show the tool info:
  log(INFO, pkg.name, pkg.version)

  const { nativeModuleNameInput } = await prompt({
    type: 'text',
    name: 'nativeModuleNameInput',
    message: 'What is the desired native module name?',
    validate: nativeModuleNameInput =>
      nativeModuleNameInput.length > 0 &&
      paramCase(nativeModuleNameInput).length > 0
  })

  const nameParamCase = paramCase(nativeModuleNameInput)

  const namePascalCase = pascalCase(nativeModuleNameInput)

  const { isView } = await prompt({
    type: 'toggle',
    name: 'isView',
    message: `Should it be a view?`,
    initial: false,
    active: 'yes',
    inactive: 'no'
  })

  // view name needs to be in PascalCase to work with jsx
  if (isView) {
    await promptForConfirmation(`View name is is ${namePascalCase}. Continue?`)
  }

  const nativeModuleName = isView ? namePascalCase : nativeModuleNameInput

  const initialModulePackageName = nameParamCase.startsWith(REACT_NATIVE_PREFIX)
    ? nameParamCase
    : REACT_NATIVE_PREFIX.concat(nameParamCase)

  const { modulePackageName } = await prompt({
    type: 'text',
    name: 'modulePackageName',
    message: 'What is the full module package name?',
    initial: initialModulePackageName,
    validate: modulePackageName => modulePackageName.length > 0
  })

  // FUTURE TBD it should be possible for the user to enter a different
  // inital package version value to start with
  await promptForConfirmation('Initial package version is 1.0.0 - continue?')

  const { nativeObjectClassNamePrefixInput } = await prompt({
    type: 'text',
    name: 'nativeObjectClassNamePrefixInput',
    message:
      'What is the desired native object class name prefix (can be blank)?',
    initial: ''
  })

  // quick solution to get the prefix in upper case, in a way that can
  // be part of a native class name (with no symbols, etc.)
  nativeObjectClassNamePrefix = pascalCase(
    nativeObjectClassNamePrefixInput
  ).toUpperCase()

  const { nativeObjectClassName } = await prompt({
    type: 'text',
    name: 'nativeObjectClassName',
    message:
      'Desired object class name to use between JavaScript & native code?',
    initial: nativeObjectClassNamePrefix.concat(namePascalCase)
  })

  const { platforms } = await prompt({
    type: 'multiselect',
    name: 'platforms',
    message: 'Which native platforms?',
    choices: [
      { title: 'Android', value: 'android', selected: true },
      { title: 'iOS', value: 'ios', selected: true },
      { title: 'Windows', value: 'windows', disabled: true }
    ],
    min: 1
  })

  const { androidPackageId } =
    platforms.indexOf('android') !== -1
      ? await prompt({
          type: 'text',
          name: 'androidPackageId',
          message: 'What is the desired Android package id?',
          initial: 'com.demo',
          validate: androidPackageId => androidPackageId.length > 0
        })
      : { androidPackageId: null }

  const { tvosEnabled } =
    platforms.indexOf('ios') !== -1
      ? await prompt({
          type: 'confirm',
          name: 'tvosEnabled',
          message: 'Support Apple tvOS (requires react-native-tvos fork)?',
          initial: false
        })
      : { tvosEnabled: null }

  // THANKS to @react-native-community/bob for the idea
  // to get user name & email from git
  const gitUserName = (await execa('git', ['config', 'user.name'])).stdout
  const gitUserEmail = (await execa('git', ['config', 'user.email'])).stdout

  const { authorName } = await prompt({
    type: 'text',
    name: 'authorName',
    message: 'What is the author name?',
    initial: gitUserName
  })

  const { authorEmail } = await prompt({
    type: 'text',
    name: 'authorEmail',
    message: 'What is the author email?',
    initial: gitUserEmail
  })

  const { githubUserAccountName } = await prompt({
    type: 'text',
    name: 'githubUserAccountName',
    message: 'What is the GitHub user account name?',
    initial: authorEmail.split('@')[0]
  })

  const { license } = await prompt({
    type: 'text',
    name: 'license',
    message: 'What license?',
    initial: 'MIT'
  })

  const { useAppleNetworking } =
    platforms.indexOf('ios') !== -1 && !isView
      ? await prompt({
          type: 'confirm',
          name: 'useAppleNetworking',
          message: 'Generate with sample use of Apple Networking?',
          initial: false
        })
      : { useAppleNetworking: false }

  log(INFO, 'It is possible to generate an example test app,')
  log(INFO, 'with workarounds in metro.config.js for metro linking issues')
  log(INFO, 'Requires Yarn (all platforms) & pod for iOS')

  const { generateExampleApp } = await prompt({
    type: 'confirm',
    name: 'generateExampleApp',
    message: 'Generate the example app (with workarounds in metro.config.js)?',
    initial: true
  })

  const exampleAppName = generateExampleApp
    ? (
        await prompt({
          type: 'text',
          name: 'exampleAppName',
          message: 'Example app name?',
          initial: 'example'
        })
      ).exampleAppName
    : null

  const reactNativeVersion = generateExampleApp
    ? (
        await prompt({
          type: 'text',
          name: 'reactNativeVersion',
          message: `What react-native version to use for the example app (should be at least ${
            tvosEnabled
              ? 'react-native@npm:react-native-tvos@0.60'
              : 'react-native@0.60'
          })?`,
          initial: tvosEnabled
            ? 'react-native@npm:react-native-tvos'
            : 'react-native@latest'
        })
      ).reactNativeVersion
    : null

  const showReactNativeOutput = generateExampleApp
    ? (
        await prompt({
          type: 'confirm',
          name: 'showReactNativeOutput',
          message: 'Show the output of React Native CLI (recommended)?',
          initial: true
        })
      ).showReactNativeOutput
    : false

  if (generateExampleApp) {
    log(INFO, 'checking that Yarn CLI can show its version')
    try {
      await execa('yarn', ['--version'])
    } catch (e) {
      log(ERROR, 'Yarn CLI not installed correctly')
      process.exit(1)
    }
    log(OK, 'Yarn CLI ok')
  }

  log(INFO, 'generating the native library module as a package')

  const createOptions = {
    name: nativeModuleName,
    moduleName: modulePackageName,
    className: nativeObjectClassName,
    packageIdentifier: androidPackageId,
    platforms,
    tvosEnabled,
    authorName,
    authorEmail,
    githubAccount: githubUserAccountName,
    view: isView,
    useAppleNetworking
  }

  await createReactNativeLibraryModule(createOptions)

  log(OK, 'native library module generated ok')

  if (generateExampleApp) {
    log(INFO, 'generating the example app')

    const exampleAppTemplate = exampleTemplates.slice(-1)[0]

    // to resolve, determine, & show the subdirectory path of the example app
    // (both relative & absolute):
    const exampleAppSubdirectory = joinPath(modulePackageName, exampleAppName)
    const exampleAppPath = resolveSubpath(modulePackageName, exampleAppName)

    await init([exampleAppName], {
      directory: exampleAppSubdirectory,
      // TODO (NEEDS FIX):
      // template: reactNativeVersion
      template: 'react-native-tvos@latest'
    })

    log(INFO, 'generating App.js in the example app')

    await fs.outputFile(
      resolveSubpath(exampleAppPath, EXAMPLE_APP_JS_FILENAME),
      exampleAppTemplate.content({
        ...createOptions,
        name: nativeObjectClassName
      })
    )

    // rewrite metro.config.js with workaround solutions
    log(
      INFO,
      `rewrite ${EXAMPLE_METRO_CONFIG_FILENAME} with workaround solutions`
    )
    await fs.outputFile(
      resolveSubpath(exampleAppPath, EXAMPLE_METRO_CONFIG_FILENAME),
      EXAMPLE_METRO_CONFIG_WORKAROUND
    )

    log(OK, 'example app generated ok')

    log(
      INFO,
      'adding the native library module into the example app as a dependency link'
    )

    await execa('yarn', ['add', 'link:../'], {
      cwd: exampleAppPath,
      stdout: showReactNativeOutput ? 'inherit' : null,
      stderr: showReactNativeOutput ? 'inherit' : null
    })

    log(
      OK,
      'added the native library module into the example app as a dependency link - ok'
    )

    if (platforms.indexOf('ios') !== -1) {
      // NOTE that the React Native CLI would offer to install the pod tool,
      // if needed (on macOS)
      log(INFO, 'checking that the pod tool can show its version')

      try {
        await execa('pod', ['--version'])
      } catch (e) {
        log(ERROR, 'pod tool not installed correctly')
        process.exit(1)
      }

      log(OK, 'pod tool ok')

      log(
        INFO,
        'starting additional pod install in ios subdirectory of example app'
      )

      try {
        await execa('pod', ['install'], {
          cwd: resolveSubpath(exampleAppPath, 'ios'),
          stdout: 'inherit',
          stderr: 'inherit'
        })
      } catch (e) {
        process.exit(1)
      }

      log(OK, 'additional pod install ok')
    }

    // show the example app info (with subdirectory path as determined above):
    log(BULB, `check out the example app in ${exampleAppSubdirectory}`)
    log(INFO, `(${exampleAppPath})`)
    log(BULB, 'recommended: run Metro Bundler in a new shell')
    log(INFO, `(cd ${exampleAppSubdirectory} && yarn start)`)
    log(BULB, 'enter the following commands to run the example app:')
    log(INFO, `cd ${exampleAppSubdirectory}`)
    platforms.forEach(platform => {
      log(INFO, `react-native run-${platform}`)
    })
    // show first steps in case of a clean checkout:
    const iosSubdirectory = joinPath(exampleAppSubdirectory, 'ios')
    log(WARN, 'first steps in case of a clean checkout')
    log(INFO, `run Yarn in ${exampleAppSubdirectory}`)
    log(INFO, `(cd ${exampleAppSubdirectory} && yarn)`)
    log(INFO, `do \`pod install\` for iOS in ${iosSubdirectory}`)
    log(INFO, `(cd ${iosSubdirectory} && pod install)`)
  }
})
