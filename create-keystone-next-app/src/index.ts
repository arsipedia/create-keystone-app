import fs from 'fs-extra';
import path from 'path';
import meow from 'meow';
import enquirer from 'enquirer';
import { checkVersion } from './checkVersion';
import { UserError } from './utils';

const createKeystoneNextAppDir = path.dirname(
  require.resolve('create-keystone-next-app/package.json')
);

const starterDir = path.join(createKeystoneNextAppDir, 'starter');

const cli = meow(
  `
Usage
  $ create-keystone-next-app [directory] --database-url postgres://...
Flags
  --database-url The Postgres connection string
`,
  {
    flags: {
      databaseUrl: {
        type: 'string',
      },
    },
  }
);

type Args = {
  directory: string;
  databaseUrl: string;
};

async function normalizeArgs(): Promise<Args> {
  let directory = cli.input[0];
  if (!directory) {
    ({ directory } = await enquirer.prompt({
      type: 'input',
      name: 'directory',
      message:
        'What directory should create-keystone-next-app generate your app into?',
      validate: (x) => !!x,
    }));
  }
  let databaseUrl = cli.flags.databaseUrl;
  if (databaseUrl && !databaseUrl.startsWith('postgres://')) {
    throw new UserError(
      'The postgres connection string must be start with postgres://'
    );
  }
  if (!databaseUrl) {
    ({ databaseUrl } = await enquirer.prompt<{ databaseUrl: string }>({
      type: 'input',
      name: 'databaseUrl',
      message: 'What database url should we use?',
      validate: (x) =>
        x.startsWith('postgres://')
          ? true
          : 'The url must start with postgres://',
    }));
  }

  return {
    directory: path.resolve(directory),
    databaseUrl,
  };
}

(async () => {
  await checkVersion();
  const normalizedArgs = await normalizeArgs();
  await fs.mkdir(normalizedArgs.directory);
  await Promise.all([
    ...[
      '.babelrc',
      '.gitignore',
      'schema.ts',
      'package.json',
      'tsconfig.json',
    ].map((filename) =>
      fs.copyFile(
        path.join(starterDir, filename),
        path.join(normalizedArgs.directory, filename)
      )
    ),
    (async () => {
      let keystoneTsContents = await fs.readFile(
        path.join(starterDir, 'keystone.ts'),
        'utf8'
      );
      keystoneTsContents = keystoneTsContents.replace(
        'DATABASE_URL_TO_REPLACE',
        `${normalizedArgs.databaseUrl}`
      );
      await fs.writeFile(
        path.join(normalizedArgs.directory, 'keystone.ts'),
        keystoneTsContents
      );
    })(),
  ]);
})().catch((err) => {
  if (err instanceof UserError) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});
