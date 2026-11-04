ALTER TABLE `auto_reset_rules` ADD `before_expiry` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `auto_reset_rules` ADD `before_expiry_minutes` integer DEFAULT 2 NOT NULL;