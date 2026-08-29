-- Estado "Aguarda Peças": já era usado pela aplicação (filtros, dashboard, portal, PDFs)
-- e escrito pelo fluxo de pedidos de peças, mas nunca chegou a existir no enum.
ALTER TYPE "InterventionStatus" ADD VALUE IF NOT EXISTS 'PENDING_PARTS';
