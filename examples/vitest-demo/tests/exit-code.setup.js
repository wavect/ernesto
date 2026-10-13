export default function setup() {
  process.on('exit', () => {
    process.exitCode = 9;
  });
}
