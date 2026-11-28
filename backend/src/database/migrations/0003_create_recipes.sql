CREATE TABLE "recipe_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recipe_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"recipe_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"supply_id" bigint,
	"sub_recipe_id" bigint,
	"quantity" numeric(12, 3) NOT NULL,
	CONSTRAINT "recipe_items_exactly_one_component" CHECK (num_nonnulls("recipe_items"."supply_id", "recipe_items"."sub_recipe_id") = 1),
	CONSTRAINT "recipe_items_not_itself" CHECK ("recipe_items"."sub_recipe_id" <> "recipe_items"."recipe_id"),
	CONSTRAINT "recipe_items_quantity_positive" CHECK ("recipe_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recipes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"yield_quantity" numeric(12, 3) NOT NULL,
	"yield_unit" "measurement_unit" NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_yield_quantity_positive" CHECK ("recipes"."yield_quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_supply_id_supplies_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."supplies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_sub_recipe_id_recipes_id_fk" FOREIGN KEY ("sub_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_items_recipe_id_idx" ON "recipe_items" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_items_supply_id_idx" ON "recipe_items" USING btree ("supply_id");--> statement-breakpoint
CREATE INDEX "recipe_items_sub_recipe_id_idx" ON "recipe_items" USING btree ("sub_recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_items_recipe_supply_unique" ON "recipe_items" USING btree ("recipe_id","supply_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_items_recipe_sub_recipe_unique" ON "recipe_items" USING btree ("recipe_id","sub_recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_name_lower_unique" ON "recipes" USING btree (lower("name"));