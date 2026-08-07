import {
	Table,
	Column,
	Model,
	DataType,
	PrimaryKey,
	AutoIncrement,
	AllowNull,
	CreatedAt,
	UpdatedAt,
	ForeignKey,
	BelongsTo,
} from 'sequelize-typescript';
import RoundStage from './RoundStage.model';

@Table({ tableName: 'stage_interventions', timestamps: true, underscored: true })
export class StageIntervention extends Model {
	@PrimaryKey
	@AutoIncrement
	@Column(DataType.BIGINT)
	id!: number;

	@ForeignKey(() => RoundStage)
	@AllowNull(false)
	@Column({ field: 'stage_id', type: DataType.BIGINT })
	stageId!: number;

	@BelongsTo(() => RoundStage)
	stage?: RoundStage;

	@AllowNull(false)
	@Column({ field: 'teacher_id', type: DataType.STRING(50) })
	teacherId!: string;

	@AllowNull(false)
	@Column({ field: 'school_id', type: DataType.STRING(50) })
	schoolId!: string;

	@AllowNull(false)
	@Column({ field: 'student_id', type: DataType.STRING(50) })
	studentId!: string;

	@AllowNull(false)
	@Column({ type: DataType.ENUM('Gujarati', 'Maths') })
	subject!: 'Gujarati' | 'Maths';

	@AllowNull(false)
	@Column({ field: 'actions_json', type: DataType.JSONB, defaultValue: [] })
	actionsJson!: string[];

	@AllowNull(false)
	@Column({ type: DataType.TEXT, defaultValue: '' })
	notes!: string;

	@CreatedAt
	@Column({ field: 'created_at', type: DataType.DATE })
	createdAt!: Date;

	@UpdatedAt
	@Column({ field: 'updated_at', type: DataType.DATE })
	updatedAt!: Date;
}

export default StageIntervention;
