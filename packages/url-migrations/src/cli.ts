import { run } from './cli-main';

run(process.argv.slice(2)).then(
  ({ code, lines }) => {
    for (const line of lines) console.log(line);
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  },
);
