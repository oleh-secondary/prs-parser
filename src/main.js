import dotenv from 'dotenv';
import { gitHubAPI } from "./api/gitHubAPI.js";
import { trelloAPI } from "./api/trelloAPI.js";

dotenv.config();

const PROJECTS = process.env.PROJECTS.split(',');
const PROJECT_OTHER = 'OTHER';
const TRELLO_CARD_ID_REGEX = /(?:\]\()?https:\/\/trello\.com\/c\/([^\/\)]+)(?:\)?)/;
const CARD_STATUSES_ORDER = {
  'Done': 0,
  'Testing on Prod': 1,
  'Testing on Staging': 2,
  'Waiting for Review': 3,
  'Doing': 4,
};

async function attachCommentsToPrs(prs) {
  const prsWithCommentsPromises = [];

  for (const pr of prs) {
    prsWithCommentsPromises.push(new Promise(async (res, rej) => {
      try {
        const commentsData = await gitHubAPI.getCommentsForPR(pr.prNumber);
        const comments = commentsData.map(comment => comment.body);

        const prWithComments = {
          ...pr,
          prComments: comments,
        };

        res(prWithComments);
      } catch (error) {
        console.log('reject comment PR:', pr);
        rej(error);
      }
    }));
  }

  const prsWithComments = await Promise.all(prsWithCommentsPromises);

  return prsWithComments;
}

function attachTrelloLinksToPrs(prs) {
  return prs.map(pr => {
    let trelloLink = null;

    for (let comment of pr.prComments) {
      if (comment.includes('https://trello.com/')) {
        trelloLink = comment.trim();
        break;
      }
    }

    return { ...pr, trelloLink };
  });
}

async function addTrelloCardDetailsToPrs(prs) {
  const prsWithTrelloCardDetails = [];

  for (let pr of prs) {
    let prCopy = { ...pr };

    if (!pr.trelloLink) {
      prsWithTrelloCardDetails.push(prCopy);
      continue;
    }

    // Extract the Trello URL from the potential markdown format
    const match = pr.trelloLink.match(TRELLO_CARD_ID_REGEX);
    if (!match) {
      prCopy.trelloCardTitle = "Error: Trello card URL does not match regex";
      prCopy.trelloCardStatus = "Error: Trello card URL does not match regex";
      prsWithTrelloCardDetails.push(prCopy);
      continue;
    }

    const cardId = match[1];
    try {
      const { cardTitle, cardStatus, cardUrl } = await trelloAPI.getCardDetailsById(cardId);
      prCopy.trelloCardTitle = cardTitle;
      prCopy.trelloCardStatus = cardStatus;
      prCopy.trelloCardUrl = cardUrl;
    } catch (error) {
      prCopy.trelloCardTitle = "Error: Unable to retrieve Trello card details";
      prCopy.trelloCardStatus = "Error: Unable to retrieve Trello card details";
    }

    prsWithTrelloCardDetails.push(prCopy);
  }

  return prsWithTrelloCardDetails;
}

function groupPrsByProject(projects, prs) {
  const groupedPrs = { [PROJECT_OTHER]: [] };

  projects.forEach(project => {
    groupedPrs[project] = [];
  });

  prs.forEach(pr => {
    const projPrefix = pr.prTitle.split(':')[0];

    if (projects.some(project => pr.prTitle.startsWith(project + ':'))) {
      if (!groupedPrs[projPrefix]) groupedPrs[projPrefix] = [];

      return groupedPrs[projPrefix].push(pr);
    } else {
      return groupedPrs[PROJECT_OTHER].push(pr);
    }
  });

  for (const project in groupedPrs) {
    groupedPrs[project].sort((a, b) => {
      const aStatus = a.trelloCardStatus;
      const bStatus = b.trelloCardStatus;

      if (aStatus === bStatus) {
        return a.prUpdatedAt > b.prUpdatedAt ? -1 : 1;
      }

      return CARD_STATUSES_ORDER[aStatus] > CARD_STATUSES_ORDER[bStatus] ? 1 : -1;
    });

    groupedPrs[project] = groupedPrs[project].map(pr => stringifyPr(pr, project === PROJECT_OTHER));
  }

  return groupedPrs;
}

function stringifyPr(pr, dontTrimTitle=false) {
  const title = pr.prTitle.slice(pr.prTitle.indexOf(':')+1).trim();
  return `${dontTrimTitle ? pr.prTitle : title} ${pr.trelloCardUrl || pr.prLink || ''} ${pr.trelloCardStatus && '(' + pr.trelloCardStatus.toUpperCase() + ')' || ''}`;
}

async function fetchAndProcessPrs(startDate, endDate) {
  // Get list of prs
  const prs = await gitHubAPI.getPrs(startDate, endDate);

  // Attach comments to prs
  const prsWithComments = await attachCommentsToPrs(prs);

  // Parse Trello link
  const prsWithTrelloLinks = await attachTrelloLinksToPrs(prsWithComments);

  // Fetch Trello card details
  const prsWithTrelloCardDetails = await addTrelloCardDetailsToPrs(prsWithTrelloLinks);

  // Group by project title
  const prsGroupedByProject = groupPrsByProject(PROJECTS, prsWithTrelloCardDetails);

  return prsGroupedByProject;
}

const startDate = '2023-11-05T00:00:00Z';
const endDate = '2023-11-08T23:59:59Z';

const processedPrs = await fetchAndProcessPrs(startDate, endDate);
console.log('RESULT:', processedPrs);
