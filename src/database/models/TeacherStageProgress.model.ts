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

@Table({ tableName: 'teacher_stage_progress', timestamps: true, underscored: true })
export class TeacherStageProgress extends Model {
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
	@Column({ type: DataType.ENUM('locked', 'active', 'completed'), defaultValue: 'locked' })
	status!: 'locked' | 'active' | 'completed';

	@AllowNull(true)
	@Column({ field: 'started_at', type: DataType.DATE })
	startedAt!: Date | null;

	@AllowNull(true)
	@Column({ field: 'completed_at', type: DataType.DATE })
	completedAt!: Date | null;

	@CreatedAt
	@Column({ field: 'created_at', type: DataType.DATE })
	createdAt!: Date;

	@UpdatedAt
	@Column({ field: 'updated_at', type: DataType.DATE })
	updatedAt!: Date;
}

export default TeacherStageProgress;
