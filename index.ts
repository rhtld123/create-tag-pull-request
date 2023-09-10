import * as core from '@actions/core';
import * as github from '@actions/github';
type Octokit = ReturnType<typeof github.getOctokit>;
async function run() {
  const increaseVersion: string = core.getInput('increaseVersion');
  const mergeBranch: string = core.getInput('mergeBranch');
  const token: string = core.getInput('token');
  const octokit = github.getOctokit(token);
  const context = github.context;
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  let tag: string;

  try {
    const {data: tags} = await octokit.rest.repos.listTags({
      owner,
      repo,
      per_page: 1,
    });

    if (tags.length === 0) {
      console.log("태그가 존재하지 않습니다. 0.0.0 으로 태그 생성을 진행합니다.");
      tag = "0.0.0";
    }

    tag = tags[0].name;
    const incrementVersion = getIncrementVersion(tag, increaseVersion);
    const {data: master} = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: 'master' // or 'main', depending on your default branch name
    });

    const masterSha = master.commit.sha;
    const releaseBranch = "release/" + incrementVersion;

    const response = await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${releaseBranch}`,
      sha: masterSha
    });

    console.log(`브랜치를 생성합니다. branch: ${releaseBranch}`);

    const mergeBranches = mergeBranch.split(",");
    for (const branch of mergeBranches) {
      await octokit.rest.repos.merge({
        owner,
        repo,
        base: releaseBranch,
        head: branch.trim()
      });
    }

    //PR 생성
    console.log("병합할 Branch들의 Pull Request Title을 가져옵니다.");
    // @ts-ignore
    const pullRequestTitles = await getPullRequestTitles(owner, repo, mergeBranches)
    console.log("Pull Request를 생성합니다.");
    const title = "v" + incrementVersion + " 배포";
    const head = "master";
    const base = releaseBranch;
    const body = pullRequestTitles.join('\n');
    const {data} = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      head,
      base,
      body
    });


  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }

}

function getIncrementVersion(lastVerison: string, increaseVersion: string): string {
  const versions = lastVerison.split(",");
  if (increaseVersion === "major") {
    return (Number(versions[0]) + 1).toString() + ".0.0"
  }

  if (increaseVersion === "minor") {
    return versions[0] + "." + (Number(versions[1]) + 1).toString() + ".0";
  }

  if (increaseVersion === "patch") {
    return versions[0] + "." + versions[1] + "." + (Number(versions[2]) + 1).toString();
  }

  throw new Error("해당 버전종류는 지원하지 않습니다.");
}

async function getPullRequestTitles(octokit: Octokit, owner: string, repo: string, branchNames: string[]): Promise<string[]> {
  const pullRequestTitles = [];

  for (const branchName of branchNames) {
    const pullRequests = await octokit.paginate(octokit.rest.pulls.list.endpoint.merge({
      owner,
      repo,
      state: 'all',
    }));

    const pr = pullRequests.find((pr:any) => pr.head.ref === branchName);

    if (pr) {
      // @ts-ignore
      pullRequestTitles.push(pr.title);
    }
  }

  return pullRequestTitles;
}

run();
