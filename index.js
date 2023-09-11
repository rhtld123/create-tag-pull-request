"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const increaseVersion = core.getInput('increaseVersion');
        const mergeBranch = core.getInput('mergeBranch');
        const token = core.getInput('token');
        const octokit = github.getOctokit(token);
        const context = github.context;
        const owner = context.repo.owner;
        const repo = context.repo.repo;
        let tag;
        try {
            const { data: tags } = yield octokit.rest.repos.listTags({
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
            const { data: master } = yield octokit.rest.repos.getBranch({
                owner,
                repo,
                branch: 'master' // or 'main', depending on your default branch name
            });
            const masterSha = master.commit.sha;
            const releaseBranch = "release/" + incrementVersion;
            const response = yield octokit.rest.git.createRef({
                owner,
                repo,
                ref: `refs/heads/${releaseBranch}`,
                sha: masterSha
            });
            console.log(`브랜치를 생성합니다. branch: ${releaseBranch}`);
            const mergeBranches = mergeBranch.split(",");
            for (const branch of mergeBranches) {
                yield octokit.rest.repos.merge({
                    owner,
                    repo,
                    base: releaseBranch,
                    head: branch.trim()
                });
            }
            //PR 생성
            console.log("병합할 Branch들의 Pull Request Title을 가져옵니다.");
            // @ts-ignore
            const pullRequestTitles = yield getPullRequestTitles(owner, repo, mergeBranches);
            console.log("Pull Request를 생성합니다.");
            const title = "v" + incrementVersion + " 배포";
            const head = "master";
            const base = releaseBranch;
            const body = pullRequestTitles.join('\n');
            const { data } = yield octokit.rest.pulls.create({
                owner,
                repo,
                title,
                head,
                base,
                body
            });
        }
        catch (error) {
            if (error instanceof Error) {
                core.setFailed(error.message);
            }
        }
    });
}
function getIncrementVersion(lastVerison, increaseVersion) {
    const versions = lastVerison.split(",");
    if (increaseVersion === "major") {
        return (Number(versions[0]) + 1).toString() + ".0.0";
    }
    if (increaseVersion === "minor") {
        return versions[0] + "." + (Number(versions[1]) + 1).toString() + ".0";
    }
    if (increaseVersion === "patch") {
        return versions[0] + "." + versions[1] + "." + (Number(versions[2]) + 1).toString();
    }
    throw new Error("해당 버전종류는 지원하지 않습니다.");
}
function getPullRequestTitles(octokit, owner, repo, branchNames) {
    return __awaiter(this, void 0, void 0, function* () {
        const pullRequestTitles = [];
        for (const branchName of branchNames) {
            const pullRequests = yield octokit.paginate(octokit.rest.pulls.list.endpoint.merge({
                owner,
                repo,
                state: 'all',
            }));
            const pr = pullRequests.find((pr) => pr.head.ref === branchName);
            if (pr) {
                // @ts-ignore
                pullRequestTitles.push(pr.title);
            }
        }
        return pullRequestTitles;
    });
}
run();
