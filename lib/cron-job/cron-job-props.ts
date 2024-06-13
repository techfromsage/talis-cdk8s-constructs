import { JobProps } from "../job";

export interface CronJobProps extends JobProps {
  /** The schedule in Cron format, see https://en.wikipedia.org/wiki/Cron */
  readonly schedule: string;

  /**
   * This flag tells the controller to suspend subsequent executions.
   * @default false
   */
  readonly suspend?: boolean;

  /**
   * Specifies whether the Job controller should create Pods or not.
   * @default false.
   */
  readonly suspendJob?: boolean;

  /**
   * Specifies the deadline in seconds for starting the job if it misses its scheduled time.
   */
  readonly startingDeadlineSeconds?: number;

  /**
   * Specifies the number of successful finished jobs to retain.
   * @default 3
   */
  readonly successfulJobsHistoryLimit?: number;

  /**
   * Specifies the number of failed finished jobs to retain.
   * @default 1
   */
  readonly failedJobsHistoryLimit?: number;
}
