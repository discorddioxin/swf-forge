package
{
   import com.gaiaonline.games.gPinball.compound_elements.Bumper;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1348")]
   public dynamic class PinballAvatarBumper extends Bumper
   {
      
      public function PinballAvatarBumper()
      {
         super();
         addFrameScript(0,frame1);
      }
      
      internal function frame1() : *
      {
         bumperInit(null);
         stop();
      }
   }
}

