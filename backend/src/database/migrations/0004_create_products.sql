CREATE TABLE "pricing_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"indirect_cost_basis_points" integer DEFAULT 0 NOT NULL,
	"target_margin_basis_points" integer DEFAULT 6000 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_settings_single_row" CHECK ("pricing_settings"."id" = 1),
	CONSTRAINT "pricing_settings_indirect_range" CHECK ("pricing_settings"."indirect_cost_basis_points" between 0 and 50000),
	CONSTRAINT "pricing_settings_target_margin_range" CHECK ("pricing_settings"."target_margin_basis_points" between 0 and 9500)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"recipe_id" bigint NOT NULL,
	"recipe_quantity" numeric(12, 3) NOT NULL,
	"price_cents" integer NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_recipe_quantity_positive" CHECK ("products"."recipe_quantity" > 0),
	CONSTRAINT "products_price_non_negative" CHECK ("products"."price_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "products_name_lower_unique" ON "products" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "products_recipe_id_idx" ON "products" USING btree ("recipe_id");