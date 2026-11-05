CREATE TABLE "outing_push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outing_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"state" text DEFAULT 'idle' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ticket_id" text,
	"ticket_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "venue_reactions" (
	"outing_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"venue_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outing_push_subscriptions" ADD CONSTRAINT "outing_push_subscriptions_outing_id_outings_id_fk" FOREIGN KEY ("outing_id") REFERENCES "public"."outings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outing_push_subscriptions" ADD CONSTRAINT "outing_push_subscriptions_outing_id_user_id_participants_outing_id_user_id_fk" FOREIGN KEY ("outing_id","user_id") REFERENCES "public"."participants"("outing_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_reactions" ADD CONSTRAINT "venue_reactions_outing_id_outings_id_fk" FOREIGN KEY ("outing_id") REFERENCES "public"."outings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_reactions" ADD CONSTRAINT "venue_reactions_outing_id_user_id_participants_outing_id_user_id_fk" FOREIGN KEY ("outing_id","user_id") REFERENCES "public"."participants"("outing_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_push_subscription_per_device" ON "outing_push_subscriptions" USING btree ("outing_id","token");--> statement-breakpoint
CREATE UNIQUE INDEX "one_reaction_per_venue" ON "venue_reactions" USING btree ("outing_id","user_id","venue_id");