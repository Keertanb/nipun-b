import type { QueryInterface } from 'sequelize';
import { DataTypes } from 'sequelize';

/** Per-stage start/end dates (Baseline / Midline / Endline). */
export async function up(queryInterface: QueryInterface): Promise<void> {
	await queryInterface.addColumn('round_stages', 'start_date', {
		type: DataTypes.DATEONLY,
		allowNull: true,
	});
	await queryInterface.addColumn('round_stages', 'end_date', {
		type: DataTypes.DATEONLY,
		allowNull: true,
	});

	await queryInterface.sequelize.query(`
		UPDATE round_stages rs
		SET start_date = rr.start_date,
		    end_date = rr.end_date
		FROM review_rounds rr
		WHERE rr.id = rs.round_id
		  AND (rs.start_date IS NULL OR rs.end_date IS NULL)
	`);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
	await queryInterface.removeColumn('round_stages', 'end_date');
	await queryInterface.removeColumn('round_stages', 'start_date');
}
