import { initOctokitRequestHandler } from '~~/server/utils/github'

export default defineCachedEventHandler(async (e) => {
  const { octokit, repo, owner } = initOctokitRequestHandler(e)
  const res = await octokit.graphql(`query ($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    all:issues {
      totalCount
    }
    closed:issues(states:CLOSED) {
      totalCount
    }
    open:issues(states:OPEN) {
      totalCount
    }
  }
}`, {
    name: repo,
    owner,
  })
  return Number.parseInt(res.repository.closed.totalCount, 10)
}, {
  // last for 1 week
  maxAge: 60 * 60 * 24 * 7,
})
