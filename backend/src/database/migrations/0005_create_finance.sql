CREATE TYPE "public"."finance_account" AS ENUM('cash', 'bank');--> statement-breakpoint
CREATE TYPE "public"."finance_entry_kind" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TABLE "finance_adjustments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "finance_adjustments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"account" "finance_account" NOT NULL,
	"amount_cents" integer NOT NULL,
	"occurred_on" date NOT NULL,
	"reason" text NOT NULL,
	"created_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_adjustments_amount_not_zero" CHECK ("finance_adjustments"."amount_cents" <> 0)
);
--> statement-breakpoint
CREATE TABLE "finance_categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "finance_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"kind" "finance_entry_kind" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_categories_id_kind_unique" UNIQUE("id","kind")
);
--> statement-breakpoint
CREATE TABLE "finance_transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "finance_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"kind" "finance_entry_kind" NOT NULL,
	"account" "finance_account" NOT NULL,
	"category_id" bigint NOT NULL,
	"amount_cents" integer NOT NULL,
	"occurred_on" date NOT NULL,
	"description" text NOT NULL,
	"created_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_transactions_amount_positive" CHECK ("finance_transactions"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "finance_transfers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "finance_transfers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"from_account" "finance_account" NOT NULL,
	"to_account" "finance_account" NOT NULL,
	"amount_cents" integer NOT NULL,
	"occurred_on" date NOT NULL,
	"description" text,
	"created_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_transfers_amount_positive" CHECK ("finance_transfers"."amount_cents" > 0),
	CONSTRAINT "finance_transfers_different_accounts" CHECK ("finance_transfers"."from_account" <> "finance_transfers"."to_account")
);
--> statement-breakpoint
ALTER TABLE "finance_adjustments" ADD CONSTRAINT "finance_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_category_kind_fk" FOREIGN KEY ("category_id","kind") REFERENCES "public"."finance_categories"("id","kind") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transfers" ADD CONSTRAINT "finance_transfers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_adjustments_occurred_on_idx" ON "finance_adjustments" USING btree ("occurred_on");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_categories_name_lower_unique" ON "finance_categories" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "finance_transactions_occurred_on_idx" ON "finance_transactions" USING btree ("occurred_on");--> statement-breakpoint
CREATE INDEX "finance_transactions_category_id_idx" ON "finance_transactions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "finance_transfers_occurred_on_idx" ON "finance_transfers" USING btree ("occurred_on");--> statement-breakpoint
-- Categorias iniciais (decisão BD): ponto de partida editável na tela de categorias.
INSERT INTO "finance_categories" ("name", "kind") VALUES
	('Vendas', 'income'),
	('Outras entradas', 'income'),
	('Insumos', 'expense'),
	('Embalagens', 'expense'),
	('Gás', 'expense'),
	('Energia elétrica', 'expense'),
	('Água', 'expense'),
	('Aluguel', 'expense'),
	('Internet e telefone', 'expense'),
	('Marketing', 'expense'),
	('Taxas e tarifas', 'expense'),
	('Equipamentos e utensílios', 'expense'),
	('Manutenção', 'expense'),
	('Transporte e entregas', 'expense'),
	('Pró-labore', 'expense'),
	('Impostos', 'expense'),
	('Outras despesas', 'expense');
