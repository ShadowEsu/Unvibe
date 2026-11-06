// Sample code for an Unvibe demo. Not from a real project.

const looksLikeAssignment = /.*(?:.*=.*)/;

function isSuspicious(line) {
  return looksLikeAssignment.test(line);
}
