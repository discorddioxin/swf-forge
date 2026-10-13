package
{
   import com.gaiaonline.games.gPinball.compound_elements.TargetGroup;
   import flash.utils.Dictionary;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1191")]
   public dynamic class GroupRockPuppy extends TargetGroup
   {
      
      public var __setPropDict:Dictionary = new Dictionary(true);
      
      public function GroupRockPuppy()
      {
         super();
         addFrameScript(0,frame1,900,frame901);
      }
      
      internal function __setProp_target0_mcPinballMachineTargetGroupRockPuppy_Layer4_901() : *
      {
         try
         {
            target0["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         target0.__Active = true;
         target0.__GroupQueue = "__HitQueue";
         target0.__DropLevel = 1;
         target0.__LightLevel = 1;
         target0.__Location = "useParent";
         target0.__SndEffectLevel = false;
         target0.__SndEffectHit = "none";
         target0.__SndEffectUnhit = "none";
         target0.__TargetType = "drop";
         try
         {
            target0["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame1() : *
      {
         popAll();
         stop();
      }
      
      internal function frame901() : *
      {
         if(__setPropDict[target0] == undefined || int(__setPropDict[target0]) != 901)
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupRockPuppy_Layer4_901();
         }
      }
   }
}

