#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const workspace = '/data/.openclaw/workspace/agent-profiles';
const configPath = '/data/.openclaw/openclaw.json';
const proposedPath = path.join(workspace, 'proposed-agents.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const proposed = JSON.parse(fs.readFileSync(proposedPath, 'utf8'));

const existingList = Array.isArray(config.agents?.list) ? config.agents.list : [];
const existingById = new Map(existingList.map(agent => [agent.id, agent]));

const merged = [...existingList];
for (const candidate of proposed.agents) {
  if (existingById.has(candidate.id)) {
    const idx = merged.findIndex(a => a.id === candidate.id);
    merged[idx] = { ...merged[idx], ...candidate };
  } else {
    merged.push(candidate);
  }
}

const patch = {
  agents: {
    list: merged
  }
};

console.log(JSON.stringify({
  note: 'Draft only. Review before applying.',
  targetConfig: configPath,
  patch
}, null, 2));
