// Sample code for an Unvibe demo. Not from a real project.

function topThree(scores) {
  return scores.sort().reverse().slice(0, 3);
}

console.log(topThree([5, 100, 25, 9]));
