import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const postSchema = ({ image }: Parameters<typeof defineCollection>[0]['schema']) =>
	z.object({
		title: z.string(),
		description: z.string(),
		// Transform string to Date object
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: z.optional(image()),
	});

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: postSchema,
});

const devlog = defineCollection({
	loader: glob({ base: './src/content/devlog', pattern: '**/*.{md,mdx}' }),
	schema: postSchema,
});

export const collections = { blog, devlog };
