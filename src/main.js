import dotenv from 'dotenv';
import { gitHubAPI } from "./api/gitHubAPI.js";
import { trelloAPI } from "./api/trelloAPI.js";

dotenv.config();

const PROJECTS = process.env.PROJECTS.split(',');
const TRELLO_CARD_ID_REGEX = /\/c\/([^\/]+)/;

async function attachCommentsToPrs(prs) {
  const prsWithComments = [];

  for (const pr of prs) {
    const commentsData = await gitHubAPI.getCommentsForPR(pr.prNumber);
    const comments = commentsData.map(comment => comment.body);

    const prWithComments = {
      ...pr,
      prComments: comments,
    };

    prsWithComments.push(prWithComments);
  }

  return prsWithComments;
}

function attachTrelloLinksToPrs(prs) {
  return prs.map(pr => {
    let trelloCardLink = null;

    for (let comment of pr.prComments) {
      if (comment.includes('https://trello.com/')) {
        trelloCardLink = comment.trim();
        break;
      }
    }

    return { ...pr, trelloCardLink };
  });
}

function groupPrsByProject(projects, prs) {
  const groupedPrs = {};

  projects.forEach(project => {
    groupedPrs[project] = [];
  });

  prs.forEach(pr => {
    projects.forEach(project => {
      if (pr.prTitle.startsWith(project + ':')) {
        groupedPrs[project].push(pr);
      }
    });
  });

  return groupedPrs;
}

async function addTrelloCardDetailsToPrs(groupedPrs) {
  for (const group in groupedPrs) {
    // Iterate over each PR within a project group
    for (let i = 0; i < groupedPrs[group].length; i++) {
      const currentPr = groupedPrs[group][i];

      const pathname = new URL(currentPr.trelloCardLink).pathname;
      const match = pathname.match(TRELLO_CARD_ID_REGEX);

      if (match === null) {
        currentPr.trelloCardTitle = "Error: Invalid Trello card link format";
        currentPr.trelloCardStatus = "Error: Invalid Trello card link format";
        continue;
      }

      const cardId = match[1];
      const { cardTitle, cardStatus } = await trelloAPI.getCardDetailsById(cardId);

      currentPr.trelloCardTitle = cardTitle;
      currentPr.trelloCardStatus = cardStatus;
    }
  }
  return groupedPrs;
}

async function fetchAndProcessPrs(startDate, endDate) {
  const prs = await gitHubAPI.getPrs(startDate, endDate);
  const prsWithComments = await attachCommentsToPrs(prs);
  const prsWithTrelloLinks = await attachTrelloLinksToPrs(prsWithComments);
  const prsGroupedByProject = groupPrsByProject(PROJECTS, prsWithTrelloLinks);
  const prsWithTrelloCardDetails = addTrelloCardDetailsToPrs(prsGroupedByProject);

  return prsWithTrelloCardDetails;
}

const startDate = '2023-10-12T00:00:00Z';
const endDate = '2023-10-17T23:59:59Z';

const processedPrs = await fetchAndProcessPrs(startDate, endDate);
console.log(processedPrs);
