import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai'
import { Configuration, OpenAIApi } from 'openai'

export interface AiTool {
  handlePrompt(prompt: string): Promise<
    Array<{
      lineNumber: string
      reviewComment: string
    }>
  >
}

export class Gpt implements AiTool {
  private adaptee: OpenAIApi

  constructor() {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY!
    })

    this.adaptee = new OpenAIApi(configuration)
  }

  public async handlePrompt(prompt: string) {
    const queryConfig = {
      model: process.env.OPENAI_API_MODEL!,
      temperature: 0.2,
      max_tokens: 700,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    }

    try {
      const response = await this.adaptee.createChatCompletion({
        ...queryConfig,
        messages: [
          {
            role: 'system',
            content: prompt
          }
        ]
      })

      const res = response.data.choices[0].message?.content?.trim() || '{}'
      const val = res.replace('```json', '').replace('```', '').trim()
      return JSON.parse(val)
    } catch (error) {
      console.error('Error:', error)
      return ''
    }
  }
}

export class Gemini implements AiTool {
  private adaptee: GenerativeModel

  constructor() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

    this.adaptee = genAI.getGenerativeModel({
      model: process.env.GEMINI_API_MODEL!
    })
  }

  public async handlePrompt(prompt: string) {
    const generationConfig = {
      temperature: 1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: 'text/plain'
    }

    try {
      const chatSession = this.adaptee.startChat({
        generationConfig,
        history: []
      })
      const response = await chatSession.sendMessage(prompt)

      const res = response.response.text() || '{}'
      const val = res.replace('```json', '').replace('```', '').trim()
      return JSON.parse(val)
    } catch (error) {
      console.error('Error:', error)
      return ''
    }
  }
}
