import { config } from 'dotenv'
import { Configuration, OpenAIApi } from 'openai'
import { Octokit } from '@octokit/rest'
import parseDiff, { Chunk, File } from 'parse-diff'
import minimatch from 'minimatch'

config()

const GITHUB_TOKEN: string = process.env.GITHUB_TOKEN!
const OPENAI_API_KEY: string = process.env.OPENAI_API_KEY!
const OPENAI_API_MODEL: string = process.env.OPENAI_API_MODEL!

const octokit = new Octokit({ auth: GITHUB_TOKEN })

const configuration = new Configuration({
  apiKey: OPENAI_API_KEY
})

const openai = new OpenAIApi(configuration)

interface PRDetails {
  owner: string
  repo: string
  pull_number: number
  title: string
  description: string
}

async function getPRDetails(link: string): Promise<PRDetails> {
  const regex = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
  const match = link.match(regex)

  if (!match) {
    throw new Error('Invalid link')
  }

  const owner = match[1]
  const repo = match[2]
  const pull_number = Number(match[3])

  const prResponse = await octokit.pulls.get({
    owner,
    repo,
    pull_number
  })

  return {
    owner,
    repo,
    pull_number,
    title: prResponse.data.title ?? '',
    description: prResponse.data.body ?? ''
  }
}

async function getDiff(
  owner: string,
  repo: string,
  pull_number: number
): Promise<string | null> {
  const response = await octokit.pulls.get({
    owner,
    repo,
    pull_number,
    mediaType: { format: 'diff' }
  })
  // @ts-expect-error - response.data is a string
  return response.data
}

async function analyzeCode(
  parsedDiff: File[],
  prDetails: PRDetails
): Promise<Array<{ body: string; path: string; line: number }>> {
  const comments: Array<{ body: string; path: string; line: number }> = []

  for (const file of parsedDiff) {
    if (file.to === '/dev/null') continue // Ignore deleted files
    for (const chunk of file.chunks) {
      const prompt = createPrompt(file, chunk, prDetails)
      const aiResponse = await getAIResponse(prompt)
      if (aiResponse) {
        const newComments: Array<{ body: string; path: string; line: number }> =
          createComment(file, chunk, aiResponse)
        if (newComments) {
          comments.push(...newComments)
        }
      }
    }
  }
  return comments
}

function createPrompt(file: File, chunk: Chunk, prDetails: PRDetails): string {
  return `Your task is to review pull requests. Instructions:
- Provide the response in following JSON format:  [{"lineNumber":  <line_number>, "reviewComment": "<review comment>"}]
- Do not give positive comments or compliments.
- Provide comments and suggestions ONLY if there is something to improve, otherwise return an empty array.
- Write the comment in GitHub Markdown format.
- Use the given description only for the overall context and only comment the code.
- If based on the code it seems to you that the developer does not really understand the topic, then give recommendations on topics that would be useful for the developer to become familiar with
- IMPORTANT: NEVER suggest adding comments to the code.

Review the following code diff in the file "${
    file.to
  }" and take the pull request title and description into account when writing the response.

Pull request title: ${prDetails.title}
Pull request description:

---
${prDetails.description}
---

Git diff to review:

\`\`\`diff
${chunk.content}
${chunk.changes
  // @ts-expect-error - ln and ln2 exists where needed
  .map((c) => `${c.ln ? c.ln : c.ln2} ${c.content}`)
  .join('\n')}
\`\`\`
`
}

async function getAIResponse(prompt: string): Promise<Array<{
  lineNumber: string
  reviewComment: string
}> | null> {
  const queryConfig = {
    model: OPENAI_API_MODEL,
    temperature: 0.2,
    max_tokens: 700,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0
  }

  try {
    const response = await openai.createChatCompletion({
      ...queryConfig,
      messages: [
        {
          role: 'system',
          content: prompt
        }
      ]
    })

    const res = response.data.choices[0].message?.content?.trim() || '{}'
    return JSON.parse(res)
  } catch (error) {
    console.error('Error:', error)
    return null
  }
}

function createComment(
  file: File,
  chunk: Chunk,
  aiResponses: Array<{
    lineNumber: string
    reviewComment: string
  }>
): Array<{ body: string; path: string; line: number }> {
  return aiResponses.flatMap((aiResponse) => {
    if (!file.to) {
      return []
    }
    return {
      body: '[GPT-REVIEW] ' + aiResponse.reviewComment,
      path: file.to,
      line: Number(aiResponse.lineNumber)
    }
  })
}

async function createReviewComment(
  owner: string,
  repo: string,
  pull_number: number,
  comments: Array<{ body: string; path: string; line: number }>
): Promise<void> {
  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number,
    comments,
    event: 'COMMENT'
  })
}

export async function main(link: string) {
  const prDetails = await getPRDetails(link)

  const diff = await getDiff(
    prDetails.owner,
    prDetails.repo,
    prDetails.pull_number
  )

  if (!diff) {
    console.log('No diff found')
    return
  }

  const parsedDiff = parseDiff(diff)

  const excludePatterns = 'yarn.lock,dist/**'.split(',').map((s) => s.trim())

  const filteredDiff = parsedDiff.filter((file) => {
    return !excludePatterns.some((pattern) => minimatch(file.to ?? '', pattern))
  })

  const comments = await analyzeCode(filteredDiff, prDetails)

  if (comments.length > 0) {
    await createReviewComment(
      prDetails.owner,
      prDetails.repo,
      prDetails.pull_number,
      comments
    )
  }
}
