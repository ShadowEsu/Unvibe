// Sample code for an Unvibe demo. Not from a real project.

function packSpeed(speed) {
  const buf = new Int16Array(1);
  buf[0] = speed;
  return buf[0];
}

console.log(packSpeed(40000));
