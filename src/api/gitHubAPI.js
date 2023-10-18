import { Octokit } from "octokit";
import dotenv from 'dotenv';

dotenv.config();

const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;

const octokit = new Octokit({
  auth: GITHUB_ACCESS_TOKEN
});

const gitHubAPI = {
  async getPrs(startDate, endDate = null) {
    if (endDate && endDate <= startDate) {
      console.error("Error: endDate should be after startDate");
      return [];
    }

    try {
      const requestUrl = `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?state=all&per_page=2&since=${startDate}`;

      // GitHub limits to 100 issues per page, so we use fetchAllPages function to get them all.
      const allIssues = await fetchAllPages(requestUrl);

      const prs = allIssues.filter(issue => {
        // Keep only those issues which are also PRs
        if (!issue.pull_request) {
          return false;
        }

        if (endDate && new Date(issue.updated_at) > new Date(endDate)) {
          return false;
        }

        return true;
      });

      return prs.map(pr => ({
        prTitle: pr.title,
        prNumber: pr.number,
        prState: pr.state,
        prUpdatedAt: pr.updated_at,
        prLink: pr.html_url,
      }));
    } catch (error) {
      console.error("Error fetching PRs:", error);
      return [];
    }
  },

  async getCommentsForPR(prNumber) {
    try {
      const response = await octokit.request("GET /repos/{owner}/{repo}/issues/{pull_number}/comments", {
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        pull_number: prNumber
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching comments for PR #${prNumber}:`, error);
      return [];
    }
  },
};

async function fetchAllPages(initialUrl) {
  let allData = [];
  let currentUrl = initialUrl;

  while (currentUrl) {
    const response = await octokit.request(`GET ${currentUrl}`);
    allData = allData.concat(response.data);

    const linkHeader = response.headers.link;
    if (!linkHeader) {
        break;
    }

    const nextLink = linkHeader.split(',').find(link => link.includes('rel="next"'));
    if (!nextLink) {
        break;
    }

    currentUrl = nextLink.match(/<(.*)>/)[1];
  }
  return allData;
}

export { gitHubAPI };
