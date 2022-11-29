import { AttachProps, BaseSensor } from './BaseSensor';

export abstract class AntPlusBaseSensor extends BaseSensor {
  protected scan(type: string) {
    return super.scan(type, 57);
  }

  protected attach(props: AttachProps) {
    return super.attach({
      ...props,
      frequency: 57,
    });
  }
}
