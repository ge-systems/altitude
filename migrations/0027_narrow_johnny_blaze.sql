PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_pireps` (
	`id` text PRIMARY KEY NOT NULL,
	`flight_number` text NOT NULL,
	`date` integer NOT NULL,
	`departure_icao` text NOT NULL,
	`arrival_icao` text NOT NULL,
	`flight_time` integer NOT NULL,
	`cargo` integer,
	`fuel_burned` integer,
	`multiplier_id` text,
	`aircraft_id` text,
	`comments` text,
	`denied_reason` text,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`multiplier_id`) REFERENCES `multipliers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`aircraft_id`) REFERENCES `aircraft`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_pireps`("id", "flight_number", "date", "departure_icao", "arrival_icao", "flight_time", "cargo", "fuel_burned", "multiplier_id", "aircraft_id", "comments", "denied_reason", "user_id", "status", "created_at", "updated_at") SELECT "id", "flight_number", "date", "departure_icao", "arrival_icao", "flight_time", "cargo", "fuel_burned", "multiplier_id", "aircraft_id", "comments", "denied_reason", "user_id", "status", "created_at", "updated_at" FROM `pireps`;--> statement-breakpoint
DROP TABLE `pireps`;--> statement-breakpoint
ALTER TABLE `__new_pireps` RENAME TO `pireps`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `pireps_status_date_index` ON `pireps` (`status`,`date`);--> statement-breakpoint
CREATE INDEX `pireps_user_status_index` ON `pireps` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `pireps_analytics_covering` ON `pireps` (`status`,`date`,`user_id`,`flight_time`);--> statement-breakpoint
CREATE INDEX `pireps_daily_stats` ON `pireps` (`status`,`date`,`flight_time`);