import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    client: z.string(),
    year: z.string(),
    discipline: z.array(z.string()),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    placeholder: z.boolean().default(false),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.date(),
    tags: z.array(z.string()).default([]),
    placeholder: z.boolean().default(false),
  }),
});

export const collections = { work, notes };
