import { stringify as toYaml } from 'yaml';

interface UserSkill {
  id: string;
  name: string;
  description: string;
  content: string;
}

export function exportUserSkill(
  skill: UserSkill,
  parity: 'required' | 'optional',
): string {
  const scenarioName = extractScenarioName(skill.content);

  const doc = {
    id: skill.id,
    title: skill.name,
    owners: ['user-created'],
    targets: ['kibana-agent-builder'],
    parity,
    inputs: [],
    outputs: [],
    requirements: [
      {
        name: skill.name,
        description: skill.description,
        scenarios: [
          {
            name: scenarioName,
            when: extractWhen(skill.content),
            then: extractThen(skill.content),
          },
        ],
      },
    ],
  };

  return toYaml(doc, { lineWidth: 0 });
}

function extractScenarioName(content: string): string {
  const headingMatch = content.match(/^##?\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  return 'default-scenario';
}

function extractWhen(content: string): string {
  const whenMatch = content.match(/when[:\s]+(.+)/i);
  if (whenMatch) return whenMatch[1].trim();
  return 'User invokes the skill';
}

function extractThen(content: string): string {
  const thenMatch = content.match(/then[:\s]+(.+)/i);
  if (thenMatch) return thenMatch[1].trim();
  return 'Skill produces expected output';
}
