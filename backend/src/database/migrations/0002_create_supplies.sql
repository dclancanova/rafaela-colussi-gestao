CREATE TYPE "public"."measurement_unit" AS ENUM('g', 'ml', 'un');--> statement-breakpoint
CREATE TYPE "public"."supply_kind" AS ENUM('ingredient', 'packaging');--> statement-breakpoint
CREATE TABLE "supplies" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"kind" "supply_kind" NOT NULL,
	"unit" "measurement_unit" NOT NULL,
	"package_quantity" integer NOT NULL,
	"package_price_cents" integer NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplies_package_quantity_positive" CHECK ("supplies"."package_quantity" > 0),
	CONSTRAINT "supplies_package_price_non_negative" CHECK ("supplies"."package_price_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "supplies_name_lower_unique" ON "supplies" USING btree (lower("name"));