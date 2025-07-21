CREATE TABLE `artifacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`type` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer,
	`checksum` text,
	`generated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `llms_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `crawled_pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`content_length` integer,
	`crawled_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`success` integer DEFAULT true NOT NULL,
	`error_message` text,
	FOREIGN KEY (`entry_id`) REFERENCES `llms_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_crawled_pages_entry_url` ON `crawled_pages` (`entry_id`,`url`);--> statement-breakpoint
CREATE TABLE `llms_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`site_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`crawl_depth` integer DEFAULT 3 NOT NULL,
	`max_pages` integer,
	`exclude_patterns` text,
	`artifacts_path` text,
	`artifacts_size` integer,
	`page_count` integer DEFAULT 0 NOT NULL,
	`error_message` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `llms_entries_name_unique` ON `llms_entries` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_llms_entries_name` ON `llms_entries` (`name`);