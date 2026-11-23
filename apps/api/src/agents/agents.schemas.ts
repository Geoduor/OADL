import { z } from 'zod';

// The manager picks the counties an agent covers. At least one, so an
// approved agent can be auto-assigned orders (D8). Ids are checked against
// the database in the service.
export const countyIdsSchema = z.object({
  countyIds: z.array(z.string().min(1).max(64)).min(1).max(47),
});

export type CountyIdsInput = z.infer<typeof countyIdsSchema>;
