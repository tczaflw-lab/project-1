CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`excerpt` text DEFAULT '' NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`author_email` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text,
	FOREIGN KEY (`author_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `posts_author_idx` ON `posts` (`author_email`);--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`created_at` text NOT NULL
);
