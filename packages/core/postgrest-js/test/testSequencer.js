const Sequencer = require('@jest/test-sequencer').default

class TestSequencer extends Sequencer {
  sort(tests) {
    // Sort tests alphabetically by file path for consistent order
    return tests.sort((testA, testB) => testA.path.localeCompare(testB.path))
  }
}

module.exports = TestSequencer
