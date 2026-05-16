import type { CohortAnchor } from '../model/types.js';

export function createDefaultCohorts(): CohortAnchor[] {
  return [
    {
      id: 'cohort-competitive',
      label: 'Competitive / Skill Expression',
      analystName: 'Ranked Sprinters',
      tags: ['Competitive', 'Skill Expression', 'Fast Sessions'],
      ratings: {},
      source: 'meta_moderator'
    },
    {
      id: 'cohort-roleplay',
      label: 'Roleplay / Social',
      analystName: 'Story Tavern',
      tags: ['Roleplay', 'Social', 'Slow Sessions'],
      ratings: {},
      source: 'meta_moderator'
    },
    {
      id: 'cohort-brainrot',
      label: 'Brain Rot / Casual',
      analystName: 'Casual Chaos',
      tags: ['Brain Rot', 'Fast Sessions', 'Casual'],
      ratings: {},
      source: 'meta_moderator'
    },
    {
      id: 'cohort-exploration',
      label: 'Exploration / Narrative',
      analystName: 'Lore Wanderers',
      tags: ['Exploration', 'Weird', 'Narrative', 'Low Pressure'],
      ratings: {},
      source: 'meta_moderator'
    },
    {
      id: 'cohort-tactical',
      label: 'Tactical / Team Coordination',
      analystName: 'Squad Operators',
      tags: ['Tactical', 'Team Coordination', 'Systems Mastery'],
      ratings: {},
      source: 'meta_moderator'
    }
  ];
}
