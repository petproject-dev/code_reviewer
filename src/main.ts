import { Command } from 'commander'
import { main } from './script'
import { version } from '../package.json'
import { Gemini, Gpt } from './tools'

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
  .option('--tool <name>', 'Use the specified tool', 'gemini')
  .action((url, options: { tool: 'gpt' | 'gemini' }) => {
    const map = {
      gpt: Gpt,
      gemini: Gemini
    }
    const tool = new map[options.tool]()

    main(tool, url).catch((error: any) => {
      console.error('Error:', error)
      process.exit(1)
    })
  })

program.parse()
