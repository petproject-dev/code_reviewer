import { Command } from 'commander'
import { main } from './script'
import { version } from '../package.json'

const program = new Command()

program
  .name('code_reviewer')
  .description('AI assistant for analysis and code review')
  .version(version)

program
  .command('review')
  .description('Analyzes diff and reviews the added PR')
  .argument(
    '<string>',
    'PR link. Format: https://github.com/{owner}/{repository_name}/pull/{pr_number}'
  )
  .action((url) => {
    main(url).catch((error: any) => {
      console.error('Error:', error)
      process.exit(1)
    })
  })

program.parse()
