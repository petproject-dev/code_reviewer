## AI Code Review
This is a helper package for automating code reviews. To run the script you need to create a .env file based on the .env.example file and add values ​​for the variables:
- GITHUB_TOKEN - [Here](https://docs.github.com/ru/actions/security-for-github-actions/security-guides/automatic-token-authentication) you can find information how to generate it
- OPENAI_API_KEY - If you don't it, sign up for an API key at [OpenAI](https://beta.openai.com/signup)
- OPENAI_API_MODEL - All available models and prices [here](https://openai.com/api/pricing/)

### How to run

```bash
npm run cli review <pr_url>
```

Example:
```bash
npm run cli review https://github.com/petproject-dev/code_reviewer/pull/1
```