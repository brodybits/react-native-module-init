const mockCallSnapshot = []

const mockPromptResponses = {
  nativeModuleName: { nativeModuleName: 'test View' },
  isView: { isView: true },
  confirmation: { confirmation: true },
  modulePackageName: { modulePackageName: 'react-native-test-view' },
  nativeObjectClassNamePrefixInput: {
    nativeObjectClassNamePrefixInput: 'native'
  },
  nativeObjectClassName: { nativeObjectClassName: 'SUPERTestView' },
  platforms: { platforms: ['android', 'ios'] },
  androidPackageId: { androidPackageId: 'com.test' },
  tvosEnabled: { tvosEnabled: false },
  authorName: { authorName: 'Ada' },
  authorEmail: { authorEmail: 'ada@lovelace.name' },
  githubUserAccountName: { githubUserAccountName: 'ada-lovelace' },
  useAppleNetworking: { useAppleNetworking: false },
  license: { license: 'BSD-4-CLAUSE' },
  generateExampleApp: { generateExampleApp: false }
}

jest.mock('console', () => ({
  log: (...args) => {
    mockCallSnapshot.push({ log: args })
  }
}))

jest.mock('prompts', () => args => {
  expect(Array.isArray(args)).toBe(true)
  mockCallSnapshot.push({ prompts: { args } })
  const optionsArray = [].concat(args)
  expect(optionsArray.length).toBe(1)
  return Promise.resolve(mockPromptResponses[optionsArray[0].name])
})

jest.mock('execa', () => (cmd, args, opts) => {
  mockCallSnapshot.push({ execa: [cmd, args, opts] })
  if (cmd === 'git') {
    return args[1] === 'user.email'
      ? Promise.resolve({ stdout: 'alice@example.com' })
      : Promise.resolve({ stdout: 'Alice' })
  } else {
    return Promise.resolve()
  }
})

jest.mock('create-react-native-module', () => o => {
  mockCallSnapshot.push({ create: o })
})

it('generate native React Native view with no example, with log', async () => {
  require('../../../main')

  await new Promise(resolve => setTimeout(resolve, 0.001))

  expect(mockCallSnapshot).toMatchSnapshot()
})
