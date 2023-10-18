import { Octokit } from "octokit";
import dotenv from 'dotenv';

dotenv.config();

const TRELLO_API_URL = 'https://api.trello.com/1';
const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

const octokit = new Octokit({});

const trelloAPI = {
  async getCardDetailsById(cardId) {
    try {
      // Get card details
      const cardResponse = await octokit.request('GET /cards/{cardId}', {
        baseUrl: TRELLO_API_URL,
        cardId: cardId,
        key: TRELLO_API_KEY,
        token: TRELLO_TOKEN
      });

      const cardData = cardResponse.data;

      // Get the list (status) of the card
      const listResponse = await octokit.request('GET /lists/{listId}', {
        baseUrl: TRELLO_API_URL,
        listId: cardData.idList,
        key: TRELLO_API_KEY,
        token: TRELLO_TOKEN
      });

      const listData = listResponse.data;

      return {
        cardTitle: cardData.name,
        cardStatus: listData.name,
      }
    } catch (error) {
      console.error('Error fetching Trello card details:', error.message);
      return "Error fetching Trello card details";
    }
  },
}

export { trelloAPI };
